import type { Ref } from 'vue'

export interface AsyncState {
  loading: Ref<boolean>
  error: Ref<string | null>
}

/**
 * 通用异步操作封装，消除 composables 间重复的 loading/error 状态管理
 *
 * @param state - 包含 loading 和 error 的响应式状态对象
 * @param operation - 异步操作函数
 * @param errorMessage - 操作失败时的默认错误信息
 * @returns 操作结果，失败返回 null
 *
 * @example
 * const state = { loading: ref(false), error: ref<string>(null) }
 * const result = await useAsync(state, () => api.someCall(), '操作失败')
 */
export async function useAsync<T>(
  state: AsyncState,
  operation: () => Promise<T>,
  errorMessage: string
): Promise<T | null> {
  state.loading.value = true
  state.error.value = null
  try {
    return await operation()
  } catch (e) {
    state.error.value = e instanceof Error ? e.message : errorMessage
    return null
  } finally {
    state.loading.value = false
  }
}

/**
 * 不设置 loading 状态的异步操作（用于不需要显示 loading 的快速操作）
 */
export async function useAsyncSilent<T>(
  state: { error: Ref<string | null> },
  operation: () => Promise<T>,
  errorMessage: string
): Promise<T | null> {
  state.error.value = null
  try {
    return await operation()
  } catch (e) {
    state.error.value = e instanceof Error ? e.message : errorMessage
    return null
  }
}
