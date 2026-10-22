import {computed,ref,shallowRef,watch} from 'vue'
import {defineStore} from 'pinia'
import {productVersionReadProvider} from '../product-version-integration'
import {ProductVersionReadError,type ProductVersionFailure,type ProductVersionMetadata} from '../domain/product-version-read'
export const useProductVersionStore=defineStore('product-version',()=>{
 const metadata=shallowRef<ProductVersionMetadata|null>(null),loading=ref(false),failure=ref<ProductVersionFailure|null>(null)
 let epoch=0,controller:AbortController|undefined
 function clear(){epoch++;controller?.abort();controller=undefined;metadata.value=null;failure.value=null;loading.value=false}
 watch(productVersionReadProvider,clear,{flush:'sync'})
 async function read(){clear();const source=productVersionReadProvider.value;if(!source)return;const generation=epoch;controller=new AbortController();const current=controller;loading.value=true
 try{const value=await source.read(current.signal);if(generation===epoch&&source===productVersionReadProvider.value&&!current.signal.aborted)metadata.value=value}
 catch(error){if(generation===epoch&&source===productVersionReadProvider.value&&!current.signal.aborted)failure.value=error instanceof ProductVersionReadError?error.code:'network'}
 finally{if(generation===epoch){loading.value=false;controller=undefined}}
 }
 const label=computed(()=>loading.value?'读取中':metadata.value?`v${metadata.value.product.version}`:failure.value==='unsupported'?'未提供产品版本（旧后端）':failure.value==='unavailable'?'版本元数据未就绪':failure.value==='unauthorized'?'认证失效':failure.value==='invalid'?'版本信息无效':failure.value==='network'?'读取失败':'版本未读取')
 const detail=computed(()=>metadata.value?`后端产品版本来自当前运行构建；构建 ${metadata.value.build.id}；源提交 ${metadata.value.build.sourceRevision}；运行文件 SHA-256 ${metadata.value.identity.entrySha256}`:'未取得当前宿主的可信产品版本；构建基线、Bridge协议与内部Git检查点都不代替后端产品版本。')
 return {metadata,loading,failure,label,detail,read,clear}
})
