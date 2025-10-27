import './style.css'
import { createApp } from './ui.js'

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app')
  if (root) {
    createApp(root)
  }
})
