import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  QueryCommandOutput,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

import { ResourceNotFoundError } from '@errors/resource-not-found-error';
import { logger } from '@shared';

const dynamoDb = new DynamoDBClient({});

interface KeySchema {
  pk: string;
  sk?: string;
}

// Example usage:
// const user: User = await getById<User>({ pk: userId, sk: optionalSortKey }, "users");
export async function getById<T>(
  keys: KeySchema,
  tableName: string,
): Promise<T> {
  const keyParams: { [key: string]: any } = {
    pk: { S: keys.pk },
  };

  if (keys.sk) {
    keyParams['sk'] = { S: keys.sk };
  }

  const params = {
    TableName: tableName,
    Key: keyParams,
  };

  try {
    const data = await dynamoDb.send(new GetItemCommand(params));

    if (!data.Item) {
      throw new ResourceNotFoundError(
        `Item with keys PK: ${keys.pk}, SK: ${keys.sk} not found`,
      );
    }

    const item = unmarshall(data.Item) as T;

    logger.info(
      `Item with PK: ${keys.pk}, SK: ${keys.sk} retrieved successfully`,
    );

    return item;
  } catch (error) {
    logger.error(`Error retrieving item: ${error}`);
    throw error;
  }
}

// Example usage:
// const { items, lastEvaluatedKey: newLastEvaluatedKey } = await list<User>(
//     tableName,
//     pageSize,
//     { pk: "user123", sk: "2023-10-17" }
// );
export async function list<T>(
  tableName: string,
  pageSize: number,
  lastEvaluatedKey?: KeySchema,
): Promise<{ items: T[]; lastEvaluatedKey?: KeySchema }> {
  const exclusiveStartKey: Record<string, any> | undefined = lastEvaluatedKey
    ? marshall({
        pk: lastEvaluatedKey.pk,
        ...(lastEvaluatedKey.sk && { sk: lastEvaluatedKey.sk }),
      })
    : undefined;

  const params = {
    TableName: tableName,
    Limit: pageSize,
    ExclusiveStartKey: exclusiveStartKey,
  };

  try {
    const data: QueryCommandOutput = await dynamoDb.send(
      new QueryCommand(params),
    );

    const items: T[] = data.Items
      ? data.Items.map((item) => unmarshall(item) as T)
      : [];

    const newLastEvaluatedKey = data.LastEvaluatedKey
      ? (unmarshall(data.LastEvaluatedKey) as KeySchema)
      : undefined;

    logger.info(`retrieved ${items.length} items from ${tableName}`);

    return { items, lastEvaluatedKey: newLastEvaluatedKey };
  } catch (error) {
    logger.error(`error listing items: ${error}`);
    throw error;
  }
}

// Example usage:
// const upsertedUser: User = await upsert<User>(newUser, "users", "user123");
export async function upsert<T>(
  newItem: T,
  tableName: string,
  id: string,
): Promise<T> {
  const params = {
    TableName: tableName,
    Item: marshall(newItem),
  };

  try {
    await dynamoDb.send(new PutItemCommand(params));

    logger.debug(`item created with ID ${id} into ${tableName}`);

    return newItem;
  } catch (error) {
    logger.error(`error creating item: ${error}`);
    throw error;
  }
}
