import { splitProps, type Component, type JSX } from 'solid-js';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'control'
  | 'icon'
  | 'tab'
  | 'link';

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
  link: 'text-fg-muted hover:text-fg transition-colors',
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
