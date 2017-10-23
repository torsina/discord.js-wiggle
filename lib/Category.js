/**
 MIT License

 Copyright (c) 2017 minemidnight

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all
 copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 SOFTWARE.
 */
const Eris = require("eris");

class Category {
    constructor(name, commandOptions) {
        this.locals = {};
        this.commands = new Eris.Collection();
        this.name = name || "default";

        this._commandOptions = commandOptions || {};
        this._middleware = [];
    }

    name(name) {
        this.name = name;
        return this;
    }

    command(...params) {
        if(params.length === 2) params = [params[0], {}, params[1]];

        params[1] = Object.assign({}, this._commandOptions, params[1]);
        params[1].category = this.name;
        this.commands.set(params[0], params.slice(1));
        return this;
    }

    use(...params) {
        const middleware = require("./middleware");
        this._middleware = this._middleware.concat(middleware(this, ...params));
        return this;
    }
}

module.exports = Category;
