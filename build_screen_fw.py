"""Compila o programa do ecrã físico (screen-firmware/, LilyGO T-Display-S3) e junta tudo num só ficheiro,
screen_fw/hc-screen.bin, que a app grava a partir do endereço 0x0 (bootloader, partições, boot_app0 e programa).
Correr antes do PyInstaller sempre que o programa do ecrã mudar:  python build_screen_fw.py"""
import os
import subprocess
import sys

import esptool

ROOT = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.join(ROOT, 'screen-firmware')
BUILD = os.path.join(PROJ, '.pio', 'build', 'tdisplays3')
OUT = os.path.join(ROOT, 'screen_fw', 'hc-screen.bin')
PIO_HOME = os.path.join(os.path.expanduser('~'), '.platformio')
PIO = os.path.join(PIO_HOME, 'penv', 'Scripts' if os.name == 'nt' else 'bin', 'pio')
BOOT_APP0 = os.path.join(PIO_HOME, 'packages', 'framework-arduinoespressif32', 'tools', 'partitions', 'boot_app0.bin')


def main():
    subprocess.run([PIO, 'run', '-d', PROJ], check=True)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    esptool.main(['--chip', 'esp32s3', 'merge-bin', '-o', OUT,
                  '--flash-mode', 'keep', '--flash-freq', 'keep', '--flash-size', '16MB',
                  '0x0', os.path.join(BUILD, 'bootloader.bin'),
                  '0x8000', os.path.join(BUILD, 'partitions.bin'),
                  '0xe000', BOOT_APP0,
                  '0x10000', os.path.join(BUILD, 'firmware.bin')])
    print(f'ok: {OUT} ({os.path.getsize(OUT)} bytes)')


if __name__ == '__main__':
    sys.exit(main())
