import * as lambda from 'aws-cdk-lib/aws-lambda';

import { Region, Stage } from '../types';

export interface EnvironmentConfig {
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
  stateful: {
    tableName: string;
  };
}

export const getEnvironmentConfig = (stage: Stage): EnvironmentConfig => {
  switch (stage) {
    case Stage.test:
      return {
        shared: {
          logging: {
            logLevel: 'DEBUG',
            logEvent: 'true',
          },
          alertingEmailAddress: 'test@test.com',
          serviceName: `lj-soccerbids-service-${Stage.test}`,
          metricNamespace: `soccerbids-${Stage.test}`,
          stage: Stage.test,
        },
        stateless: {
          runtimes: lambda.Runtime.NODEJS_20_X,
          addLatency: 'false',
        },
        env: {
          account: '111111111111',
          region: Region.dublin,
        },
        stateful: {
          tableName: `soccerbids-table-${Stage.test}`,
        },
      };
    case Stage.staging:
      return {
        shared: {
          logging: {
            logLevel: 'DEBUG',
            logEvent: 'true',
          },
          alertingEmailAddress: 'test@test.com',
          serviceName: `lj-soccerbids-service-${Stage.staging}`,
          metricNamespace: `soccerbids-${Stage.staging}`,
          stage: Stage.staging,
        },
        stateless: {
          runtimes: lambda.Runtime.NODEJS_20_X,
          addLatency: 'false',
        },
        env: {
          account: '222222222222',
          region: Region.dublin,
        },
        stateful: {
          tableName: `soccerbids-table-${Stage.staging}`,
        },
      };
    case Stage.prod:
      return {
        shared: {
          logging: {
            logLevel: 'INFO',
            logEvent: 'true',
          },
          alertingEmailAddress: 'test@test.com',
          serviceName: `lj-soccerbids-service-${Stage.prod}`,
          metricNamespace: `soccerbids-${Stage.prod}`,
          stage: Stage.prod,
        },
        stateless: {
          runtimes: lambda.Runtime.NODEJS_20_X,
          addLatency: 'false',
        },
        env: {
          account: '333333333333',
          region: Region.dublin,
        },
        stateful: {
          tableName: `soccerbids-table-${Stage.prod}`,
        },
      };
    case Stage.develop:
      return {
        shared: {
          logging: {
            logLevel: 'DEBUG',
            logEvent: 'true',
          },
          alertingEmailAddress: 'test@test.com',
          serviceName: `lj-soccerbids-service-${Stage.develop}`,
          metricNamespace: `soccerbids-${Stage.develop}`,
          stage: Stage.develop,
        },
        stateless: {
          runtimes: lambda.Runtime.NODEJS_20_X,
          addLatency: 'true', // <-- this is to simulate latency and can be toggled off and on
        },
        env: {
          account: '7777777777777',
          region: Region.dublin,
        },
        stateful: {
          tableName: `soccerbids-table-${Stage.develop}`,
        },
      };
    default:
      return {
        shared: {
          logging: {
            logLevel: 'DEBUG',
            logEvent: 'true',
          },
          alertingEmailAddress: 'test@test.com',
          serviceName: `lj-soccerbids-service-${stage}`,
          metricNamespace: `soccerbids-${stage}`,
          stage: stage,
        },
        stateless: {
          runtimes: lambda.Runtime.NODEJS_20_X,
          addLatency: 'false',
        },
        env: {
          account: '444444444444',
          region: Region.dublin,
        },
        stateful: {
          tableName: `soccerbids-table-${stage}`,
        },
      };
  }
};
