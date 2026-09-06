import { Component, createSignal } from 'solid-js';
import Input from './Input';

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
    <form onSubmit={handleSubmit} class="flex gap-2">
      <Input
        type="text"
        value={localUsername()}
        onInput={(e) => setLocalUsername(e.currentTarget.value)}
        placeholder="Last.fm username"
        class="flex-1"
      />
      <button type="submit" class="btn-secondary">
        Load
      </button>
    </form>
  );
};

export default UsernameInput;
