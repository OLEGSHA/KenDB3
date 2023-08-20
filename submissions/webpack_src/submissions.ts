import { Viewmodule, ViewmoduleManager } from 'viewmodule';

class HelloWorldModule implements Viewmodule {

    async install(root: HTMLElement, subpath: string) {
        const me = subpath.substring('/hello_'.length);

        if (me === 'lag') {
            await new Promise(res => setTimeout(res, 2000));
        }

        root.innerHTML = `
            <h1>I am ${me}</h1>
            <ul>
                <li><a href="hello_spam">Spam</a>
                <li><a href="hello_lag">Lag</a>
                <li><button type="button" data-href="hello_ham">Ham</button>
                <li><a href="hello_eggs">
                        not
                        <span style="color: green;">green</span>
                        Eggs
                    </a>
                <li><a href="https://windcorp.ru/">Get me out of here!</a>
                <li><a href="hello_foobar">
                        Hoo boy this is gonna be a wild one
                    </a>
                <li><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Juvenile_Ragdoll.jpg/667px-Juvenile_Ragdoll.jpg"
                         onclick="window.viewmoduleManager.go('hello_spam')"
                         alt="Kitten photo"
                         title="Go to spam">
            </ul>
        `;

        return {
            title: me.toUpperCase().split('').join('-'),
        }
    }

}

declare global {
    interface Window {
        viewmoduleManager: ViewmoduleManager | null
    }
}

document.addEventListener('DOMContentLoaded', () => {

    const helloWorld = new HelloWorldModule();

    window.viewmoduleManager = new ViewmoduleManager(new Map([
        ['/hello_spam', helloWorld],
        ['/hello_lag', helloWorld],
        ['/hello_eggs', helloWorld],
        ['/hello_ham', helloWorld],
    ]));

});
