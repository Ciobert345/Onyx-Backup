import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import React from 'react'
import Card from '../components/Card'

test('renders children inside Card', () => {
  render(<Card>hello</Card>)
  expect(screen.getByText('hello')).toBeInTheDocument()
})
