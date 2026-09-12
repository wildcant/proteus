# Providers

Providers live outside their parent modules to enforce the dependency boundary.

A module (e.g. `auth`, `payment`) owns the data layer — models, repositories, and services. Providers are **pluggable implementations** of a module's abstract provider interface (e.g. `AbstractAuthModuleProvider`, `AbstractPaymentProvider`). They depend on the module's public types but never on its internals (repositories, models, etc.).

Keeping them here ensures dependency-cruiser's `layer-graph-providers` rule catches any accidental coupling — `providers` may import `core` and nothing else under `src/`. A provider communicates with its module exclusively through the service interface it receives at runtime (e.g. `AuthIdentityProviderService`), not by importing module code directly.
