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
    <form onSubmit={handleSubmit} class="flex gap-2">
      <input
        type="text"
        value={localUsername()}
        onInput={(e) => setLocalUsername(e.currentTarget.value)}
        placeholder="Last.fm username"
        class="flex-1 input"
      />
      <button type="submit" class="btn-secondary">
        Load
      </button>
    </form>
  );
};

export default UsernameInput;
