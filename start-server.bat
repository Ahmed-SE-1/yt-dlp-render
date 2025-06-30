@echo off
title Video Downloader Server

:: Change to your Node.js server folder
cd /d C:\Your\Path\To\Project

:: Update yt-dlp (Python version)
echo Updating yt-dlp...
python -m pip install -U yt-dlp

:: Optional: Add yt-dlp to PATH (if needed)
:: set PATH=%PATH%;C:\Path\To\yt-dlp-folder

:: Start Node server
echo Starting Node.js server...
node app.js

pause