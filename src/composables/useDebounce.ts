import { ref, watch, type Ref } from 'vue'

/**
 * 创建一个防抖函数
 * @param fn 需要防抖的函数
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return function (this: any, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      fn.apply(this, args)
      timeoutId = null
    }, delay)
  }
}

/**
 * 创建一个防抖的 ref
 * 当 value 变化时，延迟更新 debouncedValue
 */
export function useDebounceRef<T>(value: Ref<T>, delay: number): Ref<T> {
  const debouncedValue = ref(value.value) as Ref<T>

  watch(
    value,
    (newValue) => {
      const timeoutId = setTimeout(() => {
        debouncedValue.value = newValue
      }, delay)

      return () => clearTimeout(timeoutId)
    },
    { immediate: true }
  )

  return debouncedValue
}

/**
 * 创建一个防抖的回调函数
 * 适用于需要在 watch 中使用的场景
 */
export function useDebounceFn<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  return debounce(fn, delay)
}
