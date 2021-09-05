export type TaskRecord<T> = {
  name: string, dep: string,
  fun: (v: T) => TaskRecord<T> | undefined
}

export class TaskGraph<Product> {
  productMap: Map<string, Product> = new Map;
  delayedBy: Map<string, TaskRecord<Product>[]> = new Map;

  constructor(readonly debug: number) {}

  delay_product(name: string, product: Product,
                task: TaskRecord<Product>, depends: string): void {
    this.productMap.set(name, product)
    map_append(this.delayedBy, depends, task)
  }

  do_all(finder: (depName: string) => [boolean, Product] | undefined): void {
    while (this.productMap.size) {
      if (this.debug >= 2) {
        let widgetNames = Array.from(this.productMap.keys()).join(", ");
        console.log(`delayed widgets: ${widgetNames}`)
      }
      let sz = this.productMap.size
      // 一つの widget が複数の delegate 引数宣言を持つことは普通に有る
      // 全ての delegate 引数宣言が解決しないと、その widget を delegate として使う他の widget の引数確定が始められない
      //
      for (const [dep, taskList] of this.delayedBy) {
        let path = dep.split(":");
        if (path.length === 1) {
          if (this.debug >= 2) {
            console.log(`Checking dependency for ${dep}`)
          }
          const found = finder(dep)
          if (found) {
            const [inSameTemplate, widget] = found
            let notDelayed = !this.productMap.has(dep)
            if (this.debug >= 2) {
              console.log(`-> name only. In same template? ${inSameTemplate}, Not delayed? ${notDelayed}`)
            }
            if (!inSameTemplate || notDelayed) {
              if (this.debug >= 2) {
                console.log(`No more deps, let's resolve: ${dep}`)
              }
              {
                if (this.debug >= 2) {
                  console.log(`Found widget: ${dep}`)
                }
                let len = taskList.length
                while (len-- > 0) {
                  const task = taskList.shift();
                  if (! task)
                    continue
                  if (this.debug >= 2) {
                    console.log(`Running task: ${task}`)
                  }
                  let cont = task.fun(widget)
                  if (! cont) {
                    if (this.debug >= 2) {
                      console.log(`Task completed, deleting: ${task.name}`)
                    }
                    this.productMap.delete(task.name)
                  } else {
                    if (this.debug >= 2) {
                      console.log(`Task pushed again: ${task.name}`)
                    }
                    taskList.push(task)
                  }
                }
                if (! taskList.length) {
                  this.delayedBy.delete(dep)
                }

              }
            } else if (this.debug >= 2) {
              console.log(`Skipped ${dep}`)
            }
          }
        }
        else {
          // XXX: dep が ':' を含む場合…
          throw new Error("Not implemented")
        }
      }
      if (this.productMap.size === sz) {
        let widgetNames = Array.from(this.productMap.keys()).join(", ");
        console.log(`Remaining delayed widgets: ${widgetNames}`)
        throw new Error(`Can't resolve delegates`)
      }
    }
  }
}

function map_append<K,V>(map: Map<K,V[]>, k: K, v: V): void {
  if (map.has(k)) {
    map.get(k)!.push(v)
  } else {
    map.set(k, [v]);
  }
}
