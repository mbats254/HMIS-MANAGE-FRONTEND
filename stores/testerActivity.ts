import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useTesterActivityApi, type TesterActivity, type ActivityDateRange } from '@/composables/useTesterActivityApi'

export const useTesterActivityStore = defineStore('testerActivity', () => {
  const api = useTesterActivityApi()

  const data = ref<TesterActivity | null>(null)
  const loading = ref(false)
  const error = ref('')

  async function load(range?: ActivityDateRange) {
    loading.value = true
    error.value = ''
    try {
      data.value = await api.fetch(range)
    } catch (err: any) {
      error.value = err?.response?.data?.message || 'Failed to load tester activity.'
    } finally {
      loading.value = false
    }
  }

  return { data, loading, error, load }
})
