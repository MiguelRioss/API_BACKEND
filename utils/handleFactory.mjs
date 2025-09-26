// utils/handleFactory.mjs
import errosMapping from '../errors/errosMapping.mjs';

/**
 * Wrap an async route handler: handle errors deterministically.
 * Usage:
 *   app.get('/api/orders/:id', handleFactory(getOrderByIdAPI));
 */
export default function handlerFactory(fn) {
  if (typeof fn !== 'function') {
    throw new TypeError('handleFactory expects a function');
  }
  return async function handler(req, rsp, next) {
      const promiseResult = fn(req,rsp)
      promiseResult.catch(error => sendError(rsp,error))

  }

}

function sendError(rsp,appError){
  console.log(appError)
  const httpError = errosMapping(appError)
  rsp.status(httpError.status).json(httpError.body)
}
