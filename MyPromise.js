/*

	*原生Promise里的代码是同步执行的
	*一开始处于pending状态,执行了成功回调函数会把状态改为Fulfilled,执行失败回调函数会把状态改为Rejected
*/
function MyPromise(executor){
	var self = this;
	self.status = 'pending'; //触发Promise回调函数之前Promise的状态为pending
	self.resolveValue = null; //成功回调函数的参数
	self.rejectReason = null; //失败回调函数的参数
	self.ResolveCallBackList = [];	//异步操作下的成功回调函数集
	self.RejectCallBackList = []; //异步操作下的失败回调函数集

	function resolve(value) {
		//要先进行判断,防止同时触发了成功回调和失败回调
		if(self.status === 'pending'){
			self.status = 'Fulfilled';
			self.resolveValue = value;
			//当在Promise里的代码是异步触发成功回调函数的情况下执行之前放入异步失败回调数组里的函数
			self.ResolveCallBackList.forEach(function(ele){
				ele();
			});
		}
	}

	function reject(reason){
		//要先进行判断,防止同时触发了成功回调和失败回调
		if(self.status === 'pending'){
			self.status = 'Rejected';
			self.rejectReason = reason;
			//当在Promise里的代码是异步触发失败回调函数的情况下执行之前放入异步失败回调数组里的函数
			self.RejectCallBackList.forEach(function(ele){
				ele();
			})
		}
	}

	//如果Promise()里执行的代码抛出错误,则接下来then执行失败回调函数(执行失败回调的第一种情况)
	try{
		//执行Promise里的函数(同步的)
		executor(resolve,reject);
	}catch(e){
		reject(e);
	}
};

/*
	*处理回调函数返回值Promise对象的情况 
	*此处接受的res和rej为返回的新的Promise对象里传的成功和失败回调函数,因为返回的Promise对象

*/
function ResolutionReturnPromise(nextPromise,returnValue,res,rej){
	//如果回调函数里的retrun值是Promise对象
	if(returnValue instanceof MyPromise){
		returnValue.then(function(val){
			//当这个回调函数返回的Promise对象的成功回调函数被触发,就执行下一个then的成功回调函数
			res(val);
		},function(reason){
			//当这个回调函数返回的Promise对象的失败回调函数被触发,就执行下一个then的失败回调函数(执行失败回调的第二种情况)
			rej(reason);
		})
	}else{
		/*
			*判断前面成功回调的返回值不是Promise对象了,直接执行下一个then的成功回调函数
			*在原生Promise中,哪怕前面的then执行的是失败回调函数,下一个then还是默认执行成功回调函数,只能
			*用返回promise对象的方式让下一个then执行失败回调函数
		*/
		res(returnValue);
	}
}

MyPromise.prototype.then = function(onFulfilled,onRejected){
	/*
		*(在原生Promise中 对于空的then会直接忽略执行下一个then)
		*如果没有传入回调函数,则默认把回调函数等于一个函数,函数里返回then之前要执行回调函数时所传的参数给
		 下一个then(把参数原封不动的递给下一个then)
	*/
	if(!onFulfilled){
		onFulfilled = function(val){
			return val;
		}
	}
	if(!onRejected){
		onRejected = function(reason){
			return reason;
		}
	}

	var self = this;

	//Promise每次执行完then返回的不是原来的Promise对象,而是一个新的Promise对象。哪怕这里是第一个then执行,里面的代码也会同步执行到
	var nextPromise = new MyPromise(function(res,rej){
		//当状态为Fulfilled(即当前面所注册的成功回调函数执行了),执行本次then里的成功回调函数onFulfilled
		if(self.status === 'Fulfilled'){
			/*
				如果(返回的)Promise对象里执行的是同步代码,直接执行then里对应的回调函数
				而then里的回调函数是异步执行的,这里用setTimeout模拟then里面代码的异步执行
			*/
			setTimeout(function(){
				//如果Promise()里执行的代码抛出错误,则接下来then执行失败回调函数
				try{
					//这里取得回调函数的return值 并把返回结果给ResolutionReturnPromise()函数进行判断
					var nextResolveValue = onFulfilled(self.resolveValue);
					//因为这里是在异步环境,所以取得到nextPromise
					ResolutionReturnPromise(nextPromise,nextResolveValue,res,rej);
				}catch(e){
					rej(e);
				}
			},0);
		}

		if (self.status === 'Rejected') {
            setTimeout(function () {
                try {
                    var nextRejectValue = onRejected(self.rejectReason);
                    ResolutionReturnPromise(nextPromise, nextRejectValue, res, rej);
                }catch(e) {
                    rej(e);
                }

            }, 0);
        }

        /*
        	以上是解决Promise里执行的是同步代码的情况,以下是解决Promise里执行的是异步代码的情况
			因为当Promise里的代码是异步执行时,还未执行成功回调或失败回调,下面的then就执行了,此时then的状态判断始终是pending
		*/
        if(self.status === 'pending'){
        	//如果回调函数里执行的是异步代码,先把要执行的回调函数放进一个数组里等待后面执行
        	self.ResolveCallBackList.push(function(){
        		try{
        			//执行成功回调函数 并将执行结果返回给ResolutionReturnPromise()进行判断是否回调函数返回的是Promise对象
        			var nextResolveValue = onFulfilled(self.resolveValue);
					ResolutionReturnPromise(nextPromise,nextResolveValue,res,rej);
        		}catch(e){
        			rej(e);
        		}
        	});

        	self.RejectCallBackList.push(function () {
                setTimeout(function () {
                    try {
                    	//执行失败回调函数 并将执行结果返回给ResolutionReturnPromise()进行判断是否回调函数返回的是Promise对象
                        var nextRejectValue = onRejected(self.rejectReason);
                        ResolutionReturnPromise(nextPromise, nextRejectValue, res, rej);
                    }catch(e) {
                        rej(e);
                    }
                }, 0);
            });
        }
	});

	return nextPromise;
};


MyPromise.race = function(promiseArr){
	return new MyPromise(function(resolve,reject){
		//遍历所传入的数组,哪个先触发回调函数就执行哪个的回调函数
		promiseArr.forEach(function(promise,index){
			promise.then(resolve,reject);
		});
	});
};

MyPromise.all = function (promiseArr) {
    return new MyPromise(function(resolve, reject){
        var index = 0; //记录成功回调函数执行次数
        var result = []; //存放每个成功回调函数执行后所传递的参数

        //如果MyPromise里传的是空数组,直接执行then后面的失败回调函数
        if (promiseArr.length === 0) {
            reject(result);
        } else {
        	//循环遍历数组元素并进行处理
        	for (var i = 0; i < promiseArr.length; i++) {
            	//执行MyPromise里数组的每个元素(数组的每个元素返回的都必须是Promise对象,这里才会触发then后的回调函数)
                promiseArr[i].then(function(value) {
                	//如果触发了成功回调,先对成功次数进行处理和判断
                    resolveSuccess(i, value);
                }, function(reason) {
                	//只要其中任何一次执行失败回调,就触发下一个then的失败回调(参数为先触发的那个失败回调函数传的参数)
                    reject(reason);
                })
            };

        	//对成功回调的次数进行处理和判断
            function resolveSuccess(i, value) {
                result.push(value); //把每次成功回调函数执行后所传的参数添加到数组里
                index++; //每执行一次成功回调次数加一

                //如果执行成功回调次数等于all里面的数组长度,说明全部执行成功,触发then后的成功回调
                if (index == promiseArr.length) {
                	//把成功回调参数集传给then的成功回调函数
                    resolve(result);
                }
            };
        };
    });
}
