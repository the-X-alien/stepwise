@echo off
set PY=python
where py >nul 2>nul && set PY=py
%PY% -m pip install -q -r requirements.txt
%PY% server.py
