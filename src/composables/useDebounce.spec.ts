import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { debounce, useDebounceRef, useDebounceFn } from './useDebounce'

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('debounce', () => {
    it('should delay function execution', () => {
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 100)

      debouncedFn()
      expect(fn).not.toHaveBeenCalled()

      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should pass arguments to the original function', () => {
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 100)

      debouncedFn('arg1', 2, { key: 'value' })

      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalledWith('arg1', 2, { key: 'value' })
    })

    it('should reset timer on subsequent calls', () => {
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 100)

      debouncedFn()
      vi.advanceTimersByTime(50)
      debouncedFn()
      vi.advanceTimersByTime(50)

      expect(fn).not.toHaveBeenCalled()

      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should preserve context (this)', () => {
      const context = { value: 42 }
      const fn = vi.fn(function (this: any) {
        return this.value
      })
      const debouncedFn = debounce(fn, 100)

      debouncedFn.call(context)

      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalled()
      expect(fn).toHaveBeenCalledWith()
    })

    it('should handle zero delay', () => {
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 0)

      debouncedFn()
      vi.advanceTimersByTime(0)
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })

  describe('useDebounceRef', () => {
    it('should return initial value immediately', () => {
      const value = ref('initial')
      const debouncedValue = useDebounceRef(value, 100)

      expect(debouncedValue.value).toBe('initial')
    })

    it('should update debounced value after delay', async () => {
      const value = ref('initial')
      const debouncedValue = useDebounceRef(value, 100)

      value.value = 'updated'
      expect(debouncedValue.value).toBe('initial')

      // Use real timers for async watch callback
      vi.useRealTimers()
      await new Promise((resolve) => setTimeout(resolve, 150))
      vi.useFakeTimers()

      expect(debouncedValue.value).toBe('updated')
    })

    it('should reset timer on rapid changes', async () => {
      const value = ref('initial')
      const debouncedValue = useDebounceRef(value, 100)

      value.value = 'v1'
      vi.advanceTimersByTime(50)
      value.value = 'v2'
      vi.advanceTimersByTime(50)
      value.value = 'v3'

      expect(debouncedValue.value).toBe('initial')

      // Use real timers for async watch callback
      vi.useRealTimers()
      await new Promise((resolve) => setTimeout(resolve, 150))
      vi.useFakeTimers()

      expect(debouncedValue.value).toBe('v3')
    })

    it('should handle different value types', () => {
      const numberRef = ref(42)
      const objectRef = ref({ key: 'value' })
      const arrayRef = ref([1, 2, 3])

      const debouncedNumber = useDebounceRef(numberRef, 100)
      const debouncedObject = useDebounceRef(objectRef, 100)
      const debouncedArray = useDebounceRef(arrayRef, 100)

      expect(debouncedNumber.value).toBe(42)
      expect(debouncedObject.value).toEqual({ key: 'value' })
      expect(debouncedArray.value).toEqual([1, 2, 3])
    })
  })

  describe('useDebounceFn', () => {
    it('should be an alias for debounce', () => {
      const fn = vi.fn()
      const debouncedFn = useDebounceFn(fn, 100)

      debouncedFn('test')
      expect(fn).not.toHaveBeenCalled()

      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalledWith('test')
    })

    it('should preserve all debounce behavior', () => {
      const fn = vi.fn()
      const debouncedFn = useDebounceFn(fn, 50)

      debouncedFn()
      debouncedFn()
      debouncedFn()

      vi.advanceTimersByTime(50)
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })
})
