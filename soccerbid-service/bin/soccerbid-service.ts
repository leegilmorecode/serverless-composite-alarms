#!/usr/bin/env node

import 'source-map-support/register';

import * as cdk from 'aws-cdk-lib';

import { SoccerbidServiceStatefulStack } from '../stateful/stateful';
import { SoccerbidServiceStatelessStack } from '../stateless/stateless';
import { Stage } from '../types';
import { getEnvironmentConfig } from '../app-config';
import { getStage } from '../utils';

const stage = getStage(process.env.STAGE as Stage) as Stage;
const appConfig = getEnvironmentConfig(stage);

const app = new cdk.App();
const statefulStack = new SoccerbidServiceStatefulStack(
  app,
  `SoccerbidServiceStatefulStack-${stage}`,
  {
    env: appConfig.env,
    shared: appConfig.shared,
    stateful: appConfig.stateful,
  },
);
const statelessStack = new SoccerbidServiceStatelessStack(
  app,
  `SoccerbidServiceStatelessStack-${stage}`,
  {
    env: appConfig.env,
    shared: appConfig.shared,
    stateless: appConfig.stateless,
    table: statefulStack.table,
  },
);
