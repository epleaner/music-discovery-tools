import { Component, createSignal } from 'solid-js';

interface UsernameInputProps {
  onSubmit: (username: string) => void;
  initialUsername?: string;
}

const UsernameInput: Component<UsernameInputProps> = (props) => {
  const [localUsername, setLocalUsername] = createSignal(
    props.initialUsername || ''
  );

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const username = localUsername().trim();
    if (username) {
      props.onSubmit(username);
    }
  };

  return (
    <form onSubmit={handleSubmit} class='w-full max-w-md mx-auto'>
      <div class='flex gap-2'>
        <input
          type='text'
          value={localUsername()}
          onInput={(e) => setLocalUsername(e.currentTarget.value)}
          placeholder='Enter Last.fm username'
          class='flex-1 px-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary'
        />
        <button
          type='submit'
          class='px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium'>
          Load
        </button>
      </div>
    </form>
  );
};

export default UsernameInput;


