export function passwordValidationMessage(password: string, confirmation: string) {
  if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return 'Le mot de passe doit contenir au moins 8 caractères, une lettre et un chiffre.';
  }
  if (password !== confirmation) return 'Les deux mots de passe ne correspondent pas.';
  return null;
}
