#!/bin/sh

cd "`dirname "$0"`"

SEARCHDIR=foremark

for x in `find $SEARCHDIR -iname '*.less'` \
    `find $SEARCHDIR -iname '*.css'` \
    `find $SEARCHDIR -iname '*.svg'` \
    `find $SEARCHDIR -iname '*.woff'` \
    `find $SEARCHDIR -iname '*.woff2'`
do
    mkdir -p "`dirname "dist/$x"`"
    cp "$x" "dist/$x"
done
