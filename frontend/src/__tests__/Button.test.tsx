import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Example Button component for testing
const Button = ({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) => (
  <button 
    onClick={onClick} 
    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
  >
    {children}
  </button>
);

describe('Button Component', () => {
  it('renders button with text', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByText('Click me');
    expect(button).toBeInTheDocument();
  });

  it('applies correct CSS classes', () => {
    render(<Button>Styled Button</Button>);
    const button = screen.getByText('Styled Button');
    expect(button).toHaveClass('px-4', 'py-2', 'bg-blue-500');
  });

  it('calls onClick handler when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    const button = screen.getByText('Click me');
    fireEvent.click(button);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('can be clicked multiple times', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    const button = screen.getByText('Click me');
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    
    expect(handleClick).toHaveBeenCalledTimes(3);
  });
});

// Example async component test
describe('Async Component', () => {
  it('loads and displays data', async () => {
    const AsyncComponent = () => {
      const [data, setData] = React.useState('Loading...');
      
      React.useEffect(() => {
        setTimeout(() => setData('Data loaded!'), 100);
      }, []);
      
      return <div>{data}</div>;
    };

    render(<AsyncComponent />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    
    const dataElement = await screen.findByText('Data loaded!');
    expect(dataElement).toBeInTheDocument();
  });
});
