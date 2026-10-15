import { splitProps, type Component, type JSX } from 'solid-js';

export interface ErrorMessageProps extends JSX.HTMLAttributes<HTMLDivElement> {}

const ErrorMessage: Component<ErrorMessageProps> = (props) => {
  const [local, rest] = splitProps(props, ['class']);

  return (
    <div {...rest} role="alert" class={`error-message ${local.class ?? ''}`} />
  );
};

export default ErrorMessage;
