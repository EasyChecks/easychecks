import React from 'react'

function PuffLoader({ size = 80, color = '#F26623', text = '' }) {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/30 backdrop-blur-md">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Puff animation circles */}
        <div 
          className="absolute inset-0 rounded-full animate-puff-1"
          style={{
            border: `${size / 12}px solid ${color}`,
            opacity: 0,
          }}
        />
        <div 
          className="absolute inset-0 rounded-full animate-puff-2"
          style={{
            border: `${size / 12}px solid ${color}`,
            opacity: 0,
          }}
        />
      </div>
      {text && (
        <p className="mt-6 text-gray-800 font-medium text-lg animate-pulse">
          {text}
        </p>
      )}
    </div>
  )
}

export default PuffLoader
