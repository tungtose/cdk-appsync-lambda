import * as AWS from 'aws-sdk';
import Product from './Product';
import { v4 as uuidv4 } from 'uuid';
const docClient = new AWS.DynamoDB.DocumentClient()


async function createProduct(product: Product) {
  if (!product.id) {
    product.id = uuidv4();
  }
  const params = {
    TableName: process.env.PRODUCT_TABLE!,
    Item: product
  }
  try {
    await docClient.put(params).promise()
    return product
  } catch (err) {
    console.log('DynamoDB error: ', err)
    return null
  }
}

export default createProduct
