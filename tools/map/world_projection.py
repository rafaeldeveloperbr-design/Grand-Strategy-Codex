"""Shared authoring coordinates: one world SVG, 14 units per geographic degree."""
def project(x, y, z=None):
    return (x + 180) * 14, (90 - y) * 14
