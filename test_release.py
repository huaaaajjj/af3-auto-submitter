"""Stdlib-only checks for the stable installer, legacy aliases and update header."""

from pathlib import Path
import re


def main():
    root = Path(__file__).resolve().parent
    source = root / 'af3-auto-submitter.user.js'
    raw = source.read_bytes()
    text = raw.decode('utf-8').replace('\r\n', '\n')
    header = text.split('// ==/UserScript==', 1)[0] + '// ==/UserScript==\n'
    metadata = dict(re.findall(r'^// @([\w-]+)[ 	]+(.+)$', header, re.M))
    assert re.fullmatch(r'\d+\.\d+\.\d+', metadata['version'])
    assert int(metadata['version'].split('.')[0]) >= 4
    assert 'DEV' not in metadata['name'] and not metadata['namespace'].endswith('/dev')
    assert metadata['updateURL'] == 'https://raw.githubusercontent.com/huaaaajjj/af3-auto-submitter/main/af3-auto-submitter.meta.js'
    assert metadata['downloadURL'] == 'https://raw.githubusercontent.com/huaaaajjj/af3-auto-submitter/main/af3-auto-submitter.user.js'
    assert metadata['sandbox'] == 'raw'
    grants = re.findall(r'^// @grant\s+(\S+)$', header, re.M)
    assert set(grants) == {'GM_openInTab', 'GM_getValue', 'GM_setValue', 'GM_addValueChangeListener'}
    assert len(grants) == 4 and '// @run-at       document-start' in header
    assert (root / 'af3-auto-submitter.meta.js').read_text(encoding='utf-8') == header
    for name in ['af3-auto-submitter.js', 'af3-auto-submitter.dev.user.js']:
        assert (root / name).read_bytes() == raw, 'Outdated compatibility copy: ' + name
    assert "const SCRIPT_VERSION = '" + metadata['version'] + "';" in text
    assert 'version.textContent = `v${SCRIPT_VERSION}`' in text and 'DEV /' not in text
    assert "const CONTAINER_ID = 'af3-dev-panel';" in text, 'Keep legacy v3 preference keys'
    assert "localStorage.getItem('af3-v20-panel-language')" in text
    assert "localStorage.getItem('af3-v20-panel-position')" in text
    assert "format: 'af3-fasta-batches', version: 1" in text, 'Manifest format version is independent'
    for name in ['test_submission.py', 'test_fasta.py']:
        assert "with_name('af3-auto-submitter.user.js')" in (root / name).read_text(encoding='utf-8')
    for name in ['README.md', 'index.html']:
        doc = (root / name).read_text(encoding='utf-8')
        assert 'main/af3-auto-submitter.user.js' in doc and metadata['version'] in doc
        assert '尚未合并' not in doc and 'main 的 2.24.1' not in doc
    print('PASS release ' + metadata['version'] + ': installer, metadata, grants, aliases, preferences and test entry points')


if __name__ == '__main__':
    main()
