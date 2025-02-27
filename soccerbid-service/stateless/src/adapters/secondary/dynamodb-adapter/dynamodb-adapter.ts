import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  PutItemCommandInput,
  QueryCommand,
  QueryCommandInput,
  QueryCommandOutput,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

import { ValidationError } from '@errors/validation-error';
import { logger } from '@shared';

const dynamoDb = new DynamoDBClient({});

interface KeySchema {
  pk: string;
  sk?: string;
}

interface UpsertParams<T> {
  newItem: T;
  tableName: string;
  id: string;
  preventOverwrite?: boolean;
}

// Example usage:
// const user: User = await getById<User>({ pk: userId, sk: optionalSortKey }, "users");
export async function getById<T>(
  { pk, sk }: KeySchema,
  tableName: string,
): Promise<T | null> {
  const keyParams: { [key: string]: any } = {
    pk: { S: pk },
  };

  if (sk) {
    keyParams['sk'] = { S: sk };
  }

  const params = {
    TableName: tableName,
    Key: keyParams,
  };

  try {
    const data = await dynamoDb.send(new GetItemCommand(params));

    if (!data.Item) {
      logger.debug(`Item with keys PK: ${pk}, SK: ${sk} not found`);
      return null;
    }

    const item = unmarshall(data.Item) as T;

    logger.info(`Item with PK: ${pk}, SK: ${sk} retrieved successfully`);

    return item;
  } catch (error) {
    logger.error(`Error retrieving item: ${error}`);
    throw error;
  }
}

// Example usage:
// const { items, lastEvaluatedKey } = await query<User>({
//   tableName: tableName,
//   keyConditionExpression: '#type = :type',
//   expressionAttributeValues: { ':type': 'User' },
//   expressionAttributeNames: { '#type': 'type' },
//   limit: 50,
//   scanIndexForward: ascending,
//   lastEvaluatedKey: nextTokenObject,
// });
export async function query<T>(params: {
  tableName: string;
  keyConditionExpression: string;
  expressionAttributeValues: Record<string, any>;
  expressionAttributeNames?: Record<string, string>;
  indexName?: string;
  limit?: number;
  filterExpression?: string;
  filterAttributeValues?: Record<string, any>;
  consistentRead?: boolean;
  lastEvaluatedKey?: Record<string, any>;
  scanIndexForward?: boolean;
}): Promise<{ items: T[]; lastEvaluatedKey?: Record<string, any> }> {
  const {
    tableName,
    keyConditionExpression,
    expressionAttributeValues,
    expressionAttributeNames,
    indexName,
    limit,
    filterExpression,
    filterAttributeValues,
    consistentRead = false,
    lastEvaluatedKey,
    scanIndexForward = true,
  } = params;

  const queryParams: QueryCommandInput = {
    TableName: tableName,
    KeyConditionExpression: keyConditionExpression,
    ExpressionAttributeValues: marshall(expressionAttributeValues, {
      removeUndefinedValues: true,
    }),
    IndexName: indexName,
    Limit: limit,
    ConsistentRead: consistentRead,
    ExclusiveStartKey: lastEvaluatedKey,
    ScanIndexForward: scanIndexForward,
  };

  if (expressionAttributeNames) {
    queryParams.ExpressionAttributeNames = expressionAttributeNames;
  }

  if (filterExpression) {
    queryParams.FilterExpression = filterExpression;
    if (filterAttributeValues) {
      queryParams.ExpressionAttributeValues = {
        ...queryParams.ExpressionAttributeValues,
        ...marshall(filterAttributeValues, { removeUndefinedValues: true }),
      };
    }
  }

  try {
    const data: QueryCommandOutput = await dynamoDb.send(
      new QueryCommand(queryParams),
    );
    const items: T[] = data.Items
      ? data.Items.map((item) => unmarshall(item) as T)
      : [];
    return { items, lastEvaluatedKey: data.LastEvaluatedKey };
  } catch (error) {
    console.error('Error querying DynamoDB:', error);
    throw error;
  }
}

// Example usage:
// const upsertedUser: User = await upsert<User>({ newItem: newUser, tableName: "users", id: "user123" });
export async function upsert<T>({
  newItem,
  tableName,
  id,
  preventOverwrite = false,
}: UpsertParams<T>): Promise<T> {
  const params: PutItemCommandInput = {
    TableName: tableName,
    Item: marshall(newItem),
  };

  if (preventOverwrite) {
    params.ConditionExpression =
      'attribute_not_exists(pk) AND attribute_not_exists(sk)';
  }

  try {
    await dynamoDb.send(new PutItemCommand(params));

    logger.debug(`item created with ID ${id} into ${tableName}`);

    return newItem;
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      logger.error(`Item with ID ${id} already exists in ${tableName}`);
      throw new ValidationError(`Item with ID ${id} already exists`);
    }
    logger.error(`error creating item: ${error}`);
    throw error;
  }
}
