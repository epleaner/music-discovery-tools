import { splitProps, type Component, type JSX } from 'solid-js';

export type ButtonVariant = 'primary' | 'secondary';

export interface ButtonProps
  extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function buttonClass(
  variant: ButtonVariant = 'secondary',
  className?: string
): string {
  const baseClass = variant === 'primary' ? 'btn-primary' : 'btn-secondary';
  return [baseClass, className].filter(Boolean).join(' ');
}

export const Button: Component<ButtonProps> = (props) => {
  const [local, buttonProps] = splitProps(props, ['variant', 'class']);

  return (
    <button {...buttonProps} class={buttonClass(local.variant, local.class)} />
  );
};
