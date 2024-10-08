import React from 'react';
import ToggleContent from 'Shared/ToggleContent';
import DocLink from 'Shared/DocLink/DocLink';
import { connect } from 'react-redux';
import { CodeBlock } from "UI";

const MobxDoc = (props) => {
    const { projectKey } = props;

    const mobxUsage = `import OpenReplay from '@openreplay/tracker';
import trackerMobX from '@openreplay/tracker-mobx';
//...
const tracker = new OpenReplay({
  projectKey: '${projectKey}'
});
tracker.use(trackerMobX(<options>)); // check list of available options below
// .start() returns a promise
tracker.start().then(sessionData => ... ).catch(e => ... );
`

    const mobxUsageCjs = `import OpenReplay from '@openreplay/tracker/cjs';
import trackerMobX from '@openreplay/tracker-mobx/cjs';
//...
const tracker = new OpenReplay({
  projectKey: '${projectKey}'
});
tracker.use(trackerMobX(<options>)); // check list of available options below
//...
function SomeFunctionalComponent() {
  useEffect(() => { // or componentDidMount in case of Class approach
    // .start() returns a promise
    tracker.start().then(sessionData => ... ).catch(e => ... )
  }, [])
}`

    return (
        <div className="bg-white h-screen overflow-y-auto" style={{ width: '500px' }}>
            <h3 className="p-5 text-2xl">MobX</h3>
            <div className="p-5">
                <div>
                    This plugin allows you to capture MobX events and inspect them later on while replaying session recordings. This is very useful
                    for understanding and fixing issues.
                </div>

                <div className="font-bold my-2">Installation</div>
                <CodeBlock language={'bash'} code={`npm i @openreplay/tracker-mobx --save`} />

                <div className="font-bold my-2">Usage</div>
                <p>
                    Initialize the @openreplay/tracker package as usual and load the plugin into it. Then put the generated middleware into your Redux
                    chain.
                </p>
                <div className="py-3" />

                <div className="font-bold my-2">Usage</div>
                <ToggleContent
                    label="Server-Side-Rendered (SSR)?"
                    first={<CodeBlock language={'js'} code={mobxUsage} />}
                    second={<CodeBlock language={'jsx'} code={mobxUsageCjs} />}
                />

                <DocLink className="mt-4" label="Integrate MobX" url="https://docs.openreplay.com/plugins/mobx" />
            </div>
        </div>
    );
};

MobxDoc.displayName = 'MobxDoc';

export default connect((state) => {
    const siteId = state.getIn(['integrations', 'siteId']);
    const sites = state.getIn(['site', 'list']);
    return {
      projectKey: sites.find((site) => site.get('id') === siteId).get('projectKey'),
    };
})(MobxDoc);
