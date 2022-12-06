import Product from "./Product";
import getProductById from './getProductById';
import listProducts from './listProducts';
import createProduct from './createProduct';

type AppSyncEvent = {
  info: {
    fieldName: string
  },
  arguments: {
    productId: string,
    category: string,
    product: Product,
  },
  identity: {
    username: string,
    claims: {
      [key: string]: string[]
    }
  }
}

async function handler(event: AppSyncEvent) {
  switch (event.info.fieldName) {
    case "getProductById":
      return await getProductById(event.arguments.productId)
    case "listProducts":
      return await listProducts();
    case "createProduct":
      return await createProduct(event.arguments.product);
    default:
      return null;
  }
}

export { handler };
