import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

export function useFormatters() {
  function formatDate(dateStr, format = 'MMM D, YYYY h:mm A') {
    if (!dateStr) return '-'
    return dayjs(dateStr).format(format)
  }

  function formatRelativeTime(dateStr) {
    if (!dateStr) return '-'
    return dayjs(dateStr).fromNow()
  }

  function formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`
  }

  function formatNumber(num) {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  function formatPercentage(value, decimals = 2) {
    return `${parseFloat(value).toFixed(decimals)}%`
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  function truncateUrl(url, maxLength = 50) {
    if (!url) return ''
    if (url.length <= maxLength) return url
    return url.substring(0, maxLength - 3) + '...'
  }

  function extractDomain(url) {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname
    } catch {
      return url
    }
  }

  return {
    formatDate,
    formatRelativeTime,
    formatDuration,
    formatNumber,
    formatPercentage,
    formatBytes,
    truncateUrl,
    extractDomain
  }
}
