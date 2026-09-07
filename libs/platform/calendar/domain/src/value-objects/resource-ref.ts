// docs/model/04-VALUE_OBJECTS.md SS4: "el VO mas deliberadamente ciego de todo el modelo" -
// resourceType/resourceId opacos, sin validar que el recurso exista (Scheduling no lo sabe
// ni debe saberlo - la ACL con Rental Operations vive en AvailabilityService, no aca).
export class ResourceRef {
  private constructor(
    private readonly resourceType: string,
    private readonly resourceId: string,
  ) {}

  static from(resourceType: string, resourceId: string): ResourceRef {
    if (resourceType.trim().length === 0) {
      throw new TypeError('ResourceRef.resourceType no puede estar vacio.');
    }
    if (resourceId.trim().length === 0) {
      throw new TypeError('ResourceRef.resourceId no puede estar vacio.');
    }
    return new ResourceRef(resourceType.trim(), resourceId.trim());
  }

  get type(): string {
    return this.resourceType;
  }

  get id(): string {
    return this.resourceId;
  }

  equals(other: ResourceRef): boolean {
    return this.resourceType === other.resourceType && this.resourceId === other.resourceId;
  }
}
