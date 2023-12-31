"""An autogenerator of site logo files."""

import io
from os.path import exists, getmtime

from django.conf import settings

import cairosvg
from PIL import Image

from . import autogenerators


_SIZES = (16, 24, 32, 48, 256)


def _generate_png(output, ws):
    """Render source SVG into all _SIZES and output the hires PNG."""

    # Render all sizes
    def render(size):
        return cairosvg.svg2png(
            url=str(ws['source']),
            output_width=size,
            output_height=size,
        )
    renders = { size: render(size) for size in _SIZES }

    # Output highest resolution directly
    output.write_bytes(renders[max(_SIZES)])

    # Share all renders as PIL Images
    ws['renders'] = { size: Image.open(io.BytesIO(png))
                      for size, png in renders.items() }


def _generate_ico(output, ws):
    """Create an ICO with all renders."""
    renders = [r for s, r in sorted(ws['renders'].items())]
    renders[-1].save(
        output,
        format='ico',
        sizes=[(s, s) for s in ws['renders'].keys()],
        append_images=renders[:-1],
    )


def _generate_ico_16(output, ws):
    """Create an 16x-only ICO."""
    ws['renders'][16].save(output, format='ico')


def _generate_logo_files(source, output_dir):
    """Transform source SVG into multiple useful files."""
    outputs = [(output_dir / f, gen) for f, gen in [
        ('logo.png', _generate_png),
        ('logo.ico', _generate_ico),
        ('logo_16x.ico', _generate_ico_16),
    ]]

    ws = {'source': source}
    for output, subgenerator in outputs:
        subgenerator(output, ws)


autogenerators.register(lambda: _generate_logo_files(
    source=settings.BASE_DIR / 'static' / 'logo.svg',
    output_dir=settings.BASE_DIR / 'autogenerated_static',
))
