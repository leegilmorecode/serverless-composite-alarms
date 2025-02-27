const convict = require('convict');

export const config = convict({
  // shared config
  stage: {
    doc: 'The stage being deployed',
    format: String,
    default: '',
    env: 'STAGE',
  },
  // stateful config
  tableName: {
    doc: 'The database table where we store items',
    format: String,
    default: '',
    env: 'TABLE_NAME',
  },
  // indexes
  typeIndex: {
    doc: 'The index to use for querying tickets',
    format: String,
    default: 'TypeIndex',
  },
  // add latency
  addLatency: {
    doc: 'A flag to add latency to our responses for testing the alarms',
    format: String,
    default: 'false',
    env: 'ADD_LATENCY',
  },
}).validate({ allowed: 'strict' });
