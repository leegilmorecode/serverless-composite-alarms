import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

import { Construct } from 'constructs';
import { Stage } from '../types';
import { getRemovalPolicyFromStage } from '../utils';

export interface SoccerbidServiceStatefulStackProps extends cdk.StackProps {
  shared: {
    stage: Stage;
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
      shared: { stage },
      stateful: { tableName },
    } = props;

    // we create a basic table for this example which stores our bids and tickets
    this.table = new dynamodb.Table(this, 'Table', {
      tableName: tableName,
      partitionKey: {
        name: 'pk',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'sk',
        type: dynamodb.AttributeType.STRING,
      },
      removalPolicy: getRemovalPolicyFromStage(stage),
    });
  }
}
