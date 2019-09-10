#!/bin/sh

cd "`dirname "$0"`"

for x in `find . -iname '*.less'` \
    `find . -iname '*.css'` \
    `find . -iname '*.svg'` \
    `find . -iname '*.woff'` \
    `find . -iname '*.woff2'`
do
    mkdir -p "`dirname "dist/$x"`"
    cp "$x" "dist/$x"
done
