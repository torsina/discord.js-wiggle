const fs = require("fs");
const path = require("path");

class Locale {
    constructor(resolvedPath) {
        let files = [];
        resolvedPath = path.resolve(resolvedPath, "../");
        flatDeep(walkSync(resolvedPath))
            .filter(file => ~[".js"].indexOf(path.extname(file)))
            .forEach(file => files.push(require(file)));
        let file = files.find(data => data.imports);
        while(file) {
            file.imports.forEach(imp => {
                const data = require(path.resolve(resolvedPath, imp));
                if(file.prefix) {
                    if(data.prefix) data.prefix += file.prefix;
                    else data.prefix = file.prefix;
                }

                files.push(data);
            });
            delete file.imports;

            file = files.find(data => data.imports);
        }

        files = files.map(data => {
            if(!data.prefix) return data;
            return Object.entries(data).reduce((newData, [key, value]) => {
                if(~["imports", "prefix"].indexOf(key)) return newData;
                newData[data.prefix + key] = value;
                return newData;
            }, {});
        });

        this._data = Object.assign(...files);
    }

    get(context) {
        return this._data[context];
    }

    merge(locale) {
        this._data = Object.assign(this._data, locale._data);

        return this;
    }
}

function flatDeep(arr1) {
    return arr1.reduce((acc, val) => Array.isArray(val) ? acc.concat(flatDeep(val)) : acc.concat(val), []);
};

function walkSync(dir) {
    if (!fs.lstatSync(dir).isDirectory()) return dir;

    return fs.readdirSync(dir)
        .map(f => walkSync(path.join(dir, f)));
}

module.exports = Locale;
