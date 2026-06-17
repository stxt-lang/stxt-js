export class NameNamespace {
  private readonly name: string;
  private readonly namespace: string;

  constructor(name: string, namespace: string) {
    this.name = name;
    this.namespace = namespace;
  }

  getName(): string {
    return this.name;
  }

  getNamespace(): string {
    return this.namespace;
  }
}
