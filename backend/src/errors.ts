export class ApiError extends Error {constructor(public status:number,message:string){super(message)}}
export const requireRow=<T>(value:T|null|undefined,message='Not found'):T=>{if(!value)throw new ApiError(404,message);return value};
