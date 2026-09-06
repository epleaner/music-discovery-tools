import { splitProps, type Component, type JSX } from 'solid-js';

export interface SelectProps
  extends JSX.SelectHTMLAttributes<HTMLSelectElement> {}

const Select: Component<SelectProps> = (props) => {
  const [local, rest] = splitProps(props, ['class']);

  return (
    <select
      {...rest}
      class={`input ${local.class ?? ''}`}
    />
  );
};

export default Select;
