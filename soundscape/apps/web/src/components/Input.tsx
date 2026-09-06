import { splitProps, type Component, type JSX } from 'solid-js';

export const inputClassName = 'input panel-control';

export interface InputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {}

const Input: Component<InputProps> = (props) => {
  const [local, rest] = splitProps(props, ['class']);
  const className = local.class
    ? `${inputClassName} ${local.class}`
    : inputClassName;

  return <input {...rest} class={className} />;
};

export default Input;
