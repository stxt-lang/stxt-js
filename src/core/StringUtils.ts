const DIACRITICS = /[\u0300-\u036f]+/g;

export class StringUtils {
	private constructor() {
	}

	// Usado para nodos name>>
	static rightTrim(s: string | null | undefined): string {
		if (s == null) {
			return "";
		}
		let i = s.length - 1;
		while (i >= 0 && /\s/.test(s.charAt(i))) {
			i--;
		}
		return s.substring(0, i + 1);
	}

	// Usado para nodos tipo Base64 y Hex
	static cleanSpaces(input: string): string {
		return input.replace(/\s+/g, "");
	}

	// Usado para normalizar namespace
	static lowerCase(input: string | null | undefined): string {
		if (input == null) {
			return "";
		}

		// Equivalente práctico a Locale.ROOT en JS: evitar dependencias de locale del usuario
		return input.toLowerCase();
	}

	// Usados para name de los nodos
	static compactSpaces(s: string | null | undefined): string {
		if (s == null) {
			return "";
		}
		return s.trim().replace(/\s+/g, " ");
	}

	// Usados para name normalizado de nodos
	static normalize(input: string | null | undefined): string {
		if (input == null) {
			return "";
		}
		let s = input.trim();
		if (s.length === 0) {
			return "";
		}

		// Similar a Normalizer.Form.NFKD
		s = s.normalize("NFKD");
		s = s.replace(DIACRITICS, "");
		s = s.toLowerCase();
		s = StringUtils.compactSpaces(s);

		// cualquier cosa que no sea [a-z0-9] => '-'
		s = s.replace(/[^a-z0-9]+/g, "-");

		// trim de '-'
		s = s.replace(/^-+|-+$/g, "");

		return s;
	}
}

