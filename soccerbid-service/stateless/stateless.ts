import * as cdk from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import type * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodeLambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as path from 'node:path';

import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Construct } from 'constructs';
import { Stage } from '../types';
import { getRemovalPolicyFromStage } from '../utils';

export interface SoccerbidServiceStatelessStackProps extends cdk.StackProps {
  shared: {
    stage: Stage;
    serviceName: string;
    metricNamespace: string;
    alertingEmailAddress: string;
    logging: {
      logLevel: 'DEBUG' | 'INFO' | 'ERROR';
      logEvent: 'true' | 'false';
    };
  };
  env: {
    account: string;
    region: string;
  };
  stateless: {
    runtimes: lambda.Runtime;
    addLatency: string;
  };
  table: dynamodb.Table;
}

export class SoccerbidServiceStatelessStack extends cdk.Stack {
  private table: dynamodb.Table;
  private api: apigw.RestApi;

  constructor(
    scope: Construct,
    id: string,
    props: SoccerbidServiceStatelessStackProps,
  ) {
    super(scope, id, props);

    const {
      shared: {
        stage,
        serviceName,
        metricNamespace,
        logging: { logLevel, logEvent },
        alertingEmailAddress,
      },
      stateless: { runtimes, addLatency },
      table,
    } = props;

    this.table = table;

    const lambdaConfig = {
      LOG_LEVEL: logLevel,
      POWERTOOLS_LOGGER_LOG_EVENT: logEvent,
      POWERTOOLS_LOGGER_SAMPLE_RATE: '1',
      POWERTOOLS_TRACE_ENABLED: 'enabled',
      POWERTOOLS_TRACER_CAPTURE_HTTPS_REQUESTS: 'true',
      POWERTOOLS_SERVICE_NAME: serviceName,
      POWERTOOLS_TRACER_CAPTURE_RESPONSE: 'true',
      POWERTOOLS_METRICS_NAMESPACE: metricNamespace,
    };

    // create a basic lambda function for getting tickets
    const getTicketsLambda: nodeLambda.NodejsFunction =
      new nodeLambda.NodejsFunction(this, 'GetTicketsLambda', {
        functionName: `get-tickets-lambda-${stage}`,
        runtime: runtimes,
        entry: path.join(
          __dirname,
          './src/adapters/primary/get-tickets/get-tickets.adapter.ts',
        ),
        memorySize: 1024,
        description: 'Get all tickets',
        logRetention: logs.RetentionDays.ONE_DAY,
        handler: 'handler',
        architecture: lambda.Architecture.ARM_64,
        tracing: lambda.Tracing.ACTIVE,
        environment: {
          ...lambdaConfig,
          TABLE_NAME: this.table.tableName,
          STAGE: stage,
          ADD_LATENCY: addLatency,
        },
        bundling: {
          minify: true,
          externalModules: ['@aws-sdk/*'],
        },
      });
    getTicketsLambda.applyRemovalPolicy(getRemovalPolicyFromStage(stage));

    // create a basic lambda function for placing bids
    const placeBidLambda: nodeLambda.NodejsFunction =
      new nodeLambda.NodejsFunction(this, 'PlaceBidLambda', {
        functionName: `place-bid-lambda-${stage}`,
        runtime: runtimes,
        entry: path.join(
          __dirname,
          './src/adapters/primary/place-bid/place-bid.adapter.ts',
        ),
        memorySize: 1024,
        handler: 'handler',
        architecture: lambda.Architecture.ARM_64,
        tracing: lambda.Tracing.ACTIVE,
        description: 'Place a bid on a ticket',
        logRetention: logs.RetentionDays.ONE_DAY,
        environment: {
          ...lambdaConfig,
          TABLE_NAME: this.table.tableName,
          STAGE: stage,
          ADD_LATENCY: addLatency,
        },
        bundling: {
          minify: true,
          externalModules: ['@aws-sdk/*'],
        },
      });
    placeBidLambda.applyRemovalPolicy(getRemovalPolicyFromStage(stage));

    // add the latency alarms for the lambda functions
    const lambdaLatencyAlarms = [getTicketsLambda, placeBidLambda].map(
      (lambdaFn, index) =>
        new cloudwatch.Alarm(this, `LambdaLatencyAlarm${index}`, {
          metric: lambdaFn.metricDuration({ period: cdk.Duration.minutes(1) }),
          threshold: 1000, // Add an initial threshold of 1 second
          evaluationPeriods: 1,
          datapointsToAlarm: 1,
          comparisonOperator:
            cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
          alarmDescription: `Alarm for high latency in ${lambdaFn.functionName} in stage ${stage}`,
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
          alarmName: `SoccerBid LambdaLatencyAlarm ${stage} ${lambdaFn.functionName}`,
          actionsEnabled: true,
        }),
    );
    lambdaLatencyAlarms.forEach((alarm) =>
      alarm.applyRemovalPolicy(getRemovalPolicyFromStage(stage)),
    );

    // give the lambda functions access to the dynamodb table
    this.table.grantReadData(getTicketsLambda);
    this.table.grantReadWriteData(placeBidLambda);

    // create our api for soccerbids app
    this.api = new apigw.RestApi(this, 'Api', {
      description: `(${stage}) SoccerBids API`,
      restApiName: `${stage}-soccerbids-api`,
      endpointTypes: [apigw.EndpointType.EDGE],
      deploy: true,
      deployOptions: {
        stageName: 'api',
        loggingLevel: apigw.MethodLoggingLevel.INFO,
      },
    });

    const root: apigw.Resource = this.api.root.addResource('v1');
    const tickets: apigw.Resource = root.addResource('tickets');
    const bids: apigw.Resource = root.addResource('bids');

    // add the latency alarm for the api gateway
    const apiLatencyAlarm = new cloudwatch.Alarm(
      this,
      'ApiGatewayLatencyAlarm',
      {
        metric: this.api.metricLatency({ period: cdk.Duration.minutes(1) }),
        threshold: 1000, // Add an initial threshold of 1 second
        evaluationPeriods: 1,
        datapointsToAlarm: 1,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        alarmDescription: `Alarm for high API Gateway latency for stage ${stage}`,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmName: `SoccerBid ApiGatewayLatencyAlarm ${stage}`,
        actionsEnabled: true,
      },
    );
    apiLatencyAlarm.applyRemovalPolicy(getRemovalPolicyFromStage(stage));

    // add the composite alarm for the api gateway and lambda functions
    const compositeAlarm = new cloudwatch.CompositeAlarm(
      this,
      'CompositeLatencyAlarm',
      {
        alarmRule: cloudwatch.AlarmRule.allOf(
          apiLatencyAlarm,
          ...lambdaLatencyAlarms,
        ),
        alarmDescription: `${stage} Composite alarm for high latency across Lambda, and DynamoDB`,
        compositeAlarmName: `SoccerBid CompositeLatencyAlarm ${stage}`,
        actionsEnabled: true,
      },
    );
    compositeAlarm.applyRemovalPolicy(getRemovalPolicyFromStage(stage));

    // point the api resources to the lambda functions
    tickets.addMethod(
      'GET',
      new apigw.LambdaIntegration(getTicketsLambda, {
        proxy: true,
      }),
    );

    bids.addMethod(
      'POST',
      new apigw.LambdaIntegration(placeBidLambda, {
        proxy: true,
      }),
    );

    // create the sns topic for the composite alarm
    const topic = new sns.Topic(this, 'StatelessAlarmTopic', {
      displayName: `StatelessCompositeAlarmTopic ${stage}`,
      topicName: `StatelessCompositeAlarmTopic${stage}`,
    });

    // add an action for the alarm which sends to our sns topic
    compositeAlarm.addAlarmAction(new SnsAction(topic));

    // send an email when a message drops into the topic
    topic.addSubscription(new snsSubs.EmailSubscription(alertingEmailAddress));
  }
}
