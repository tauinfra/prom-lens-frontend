import { ref, watch } from 'vue'
import { debounce } from 'lodash'

/**
 * 分页参数类型
 */
export interface Pagination {
  page: number
  size: number
  total: number
  sortBy: string
  sortOrder: 'asc' | 'desc'
  keyword: string
  type?: string   // 新增类型
}

export interface UsePaginatedSearchOptions {
  debounceTime?: number
  initialPage?: number
  initialSize?: number
  initialSortBy?: string
  initialSortOrder?: 'asc' | 'desc'
  initialTotal?: number
}

/**
 * 通用分页 + 搜索 Hook
 */
export function usePaginatedSearch(
  fetchFn: (pagination: Pagination) => void | Promise<void>,
  options: UsePaginatedSearchOptions = {}
) {
  const {
    debounceTime = 800,
    initialPage = 1,
    initialSize = 10,
    initialSortBy = 'id',
    initialSortOrder = 'asc',
    initialTotal = 1 // 关键：避免 el-pagination 锁死
  } = options

  const pagination = ref<Pagination>({
    page: initialPage,
    size: initialSize,
    total: initialTotal,
    sortBy: initialSortBy,
    sortOrder: initialSortOrder,
    keyword: ''
  })

  /**
   * 防抖请求（仅用于 keyword）
   */
  const debouncedFetch = debounce(() => {
    fetchFn(pagination.value)
  }, debounceTime)

  /**
   * 关键词变化：
   * - 重置页码
   * - 防抖请求
   */
  watch(
    () => pagination.value.keyword,
    () => {
      pagination.value.page = initialPage
      debouncedFetch()
    }
  )

  /**
   * 页码 / pageSize / 排序变化：
   * - 立即请求
   * - 页面初始化立即触发一次
   */
  watch(
    [
      () => pagination.value.page,
      () => pagination.value.size,
      () => pagination.value.sortBy,
      () => pagination.value.sortOrder
    ],
    () => {
      fetchFn(pagination.value)
    }
  )

  /**
   * 手动刷新（例如：新增 / 删除后）
   */
  const refresh = () => {
    fetchFn(pagination.value)
  }

  return {
    pagination,
    refresh
  }
}
