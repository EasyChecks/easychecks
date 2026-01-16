import React, { createContext, useState } from 'react'
import PuffLoader from '../components/common/PuffLoader'

export const LoadingContext = createContext()

export function LoadingProvider({ children }) {
  const [isLoading, setIsLoading] = useState(false)
  const [loadingText, setLoadingText] = useState('')

  const showLoading = (text = '') => {
    setLoadingText(text)
    setIsLoading(true)
  }

  const hideLoading = () => {
    setIsLoading(false)
    setLoadingText('')
  }

  return (
    <LoadingContext.Provider value={{ isLoading, showLoading, hideLoading }}>
      {isLoading && <PuffLoader text={loadingText} />}
      {children}
    </LoadingContext.Provider>
  )
}
