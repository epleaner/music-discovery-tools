import { splitProps, type Component, type JSX } from 'solid-js';

export type ButtonVariant = 'primary' | 'secondary' | 'control' | 'icon' | 'tab';

export interface ButtonProps
  extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClassName: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  control: 'panel-control',
  icon: 'control-icon',
  tab: 'panel-tab',
};

const Button: Component<ButtonProps> = (props) => {
  const [local, rest] = splitProps(props, ['variant', 'class']);

  return (
    <button
      {...rest}
      class={`${variantClassName[local.variant ?? 'control']} ${local.class ?? ''}`}
    />
  );
};
export default Button;
