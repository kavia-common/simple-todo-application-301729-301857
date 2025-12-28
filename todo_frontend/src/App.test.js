import { render, screen } from '@testing-library/react';
import App from './App';

test('renders header and new task input', () => {
  render(<App />);
  expect(screen.getByText(/Tasks/i)).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/Add a new task/i)).toBeInTheDocument();
});
