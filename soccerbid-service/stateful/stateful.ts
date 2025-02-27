import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as path from 'path';

import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Construct } from 'constructs';
import { SimpleTable } from '../app-constructs/simple-table';
import { Stage } from '../types';
import { getRemovalPolicyFromStage } from '../utils';

export interface SoccerbidServiceStatefulStackProps extends cdk.StackProps {
  shared: {
    stage: Stage;
    alertingEmailAddress: string;
  };
  env: {
    account: string;
    region: string;
  };
  stateful: {
    tableName: string;
  };
}

export class SoccerbidServiceStatefulStack extends cdk.Stack {
  public readonly table: dynamodb.Table;

  constructor(
    scope: Construct,
    id: string,
    props: SoccerbidServiceStatefulStackProps,
  ) {
    super(scope, id, props);

    const {
      shared: { stage, alertingEmailAddress },
      stateful: { tableName },
    } = props;

    // we create a basic table for this example which stores our bids and tickets
    this.table = new SimpleTable(this, 'Table', {
      tableName: tableName,
      stageName: stage,
      nonStages: [Stage.prod, Stage.staging], // the stages where we don't want to autopopulate the table
      dataPath: path.join(__dirname, '../data/'), // the path to the json file with our tickets data
      removalPolicy: getRemovalPolicyFromStage(stage),
      partitionKey: {
        name: 'pk',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'sk',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PROVISIONED, // <-- only for this example to show alarms
      readCapacity: 1, // <-- only for this example to show alarms
      writeCapacity: 1, // <-- only for this example to show alarms
    }).table;

    const indexName = 'TypeIndex';

    // add a gsi so we can query the tickets and list them
    this.table.addGlobalSecondaryIndex({
      indexName,
      partitionKey: { name: 'type', type: dynamodb.AttributeType.STRING }, // query on entity type
      sortKey: { name: 'created', type: dynamodb.AttributeType.STRING }, // sort by creation date
      projectionType: dynamodb.ProjectionType.ALL,
      maxReadRequestUnits: 1, // <-- only for this example to show alarms
      maxWriteRequestUnits: 1, // <-- only for this example to show alarms
    });

    const dynamoDBQueryThrottleAlarm = new cloudwatch.Alarm(
      this,
      'DynamoDBQueryIndexThrottleAlarm',
      {
        metric: this.table.metricThrottledRequestsForOperation('Query', {
          statistic: 'Sum',
          period: cdk.Duration.minutes(1),
          dimensionsMap: {
            GlobalSecondaryIndexName: indexName,
          },
        }),
        threshold: 1, // the alarm will go off if the throttle count is greater than 1
        evaluationPeriods: 1,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        alarmDescription: `${stage} - Query throttling events on GSI ${indexName}`,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmName: `SoccerBid DynamoDBQueryThrottleAlarm ${stage}`,
        actionsEnabled: true,
      },
    );

    const dynamoDBPutItemLatencyAlarm = new cloudwatch.Alarm(
      this,
      'DynamoDBPutItemLatencyAlarm',
      {
        metric: this.table.metricSuccessfulRequestLatency({
          statistic: 'Average',
          period: cdk.Duration.minutes(1),
          dimensionsMap: {
            TableName: this.table.tableName,
            Operation: 'PutItem',
          },
        }),
        threshold: 3, // the alarm will go off if the latency is greater than 3ms as an example only
        evaluationPeriods: 1,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        alarmDescription: 'Alarm for high DynamoDB PutItem latency',
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmName: `SoccerBid DynamoDBPutItemLatencyAlarm ${stage}`,
        actionsEnabled: true,
      },
    );

    // create the composite alarm for the database table consisting of the two alarms
    const compositeAlarm = new cloudwatch.CompositeAlarm(
      this,
      'CompositeTableLatencyAlarm',
      {
        alarmRule: cloudwatch.AlarmRule.anyOf(
          dynamoDBPutItemLatencyAlarm,
          dynamoDBQueryThrottleAlarm,
        ),
        alarmDescription: `${stage} Composite alarm for high latency and throttling across DynamoDB`,
        compositeAlarmName: `SoccerBid CompositeTableLatencyAlarm ${stage}`,
        actionsEnabled: true,
      },
    );
    compositeAlarm.applyRemovalPolicy(getRemovalPolicyFromStage(stage));

    // create the sns topic for the composite alarm
    const topic = new sns.Topic(this, 'StatefulAlarmTopic', {
      displayName: `StatefulCompositeAlarmTopic ${stage}`,
      topicName: `StatefulCompositeAlarmTopic${stage}`,
    });

    // add an action for the alarm which sends to our sns topic
    compositeAlarm.addAlarmAction(new SnsAction(topic));

    // send an email when a message drops into the topic
    topic.addSubscription(new snsSubs.EmailSubscription(alertingEmailAddress));
  }
}
